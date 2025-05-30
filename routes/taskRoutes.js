import * as tasksController from "../controllers/tasksController.js"
import { parseRequestBody } from "../utils/helpers.js"
import { parseMultipartData } from "../utils/multipart.js"

export default async function tasksRoutes(req, res) {
	const { method, url } = req
	const [route, queryString] = url.split("?")
	const id = route.split("/")[2]
	const queryParams = new URLSearchParams(queryString || "")

	try {
		let body = {}

		if (["POST", "PUT", "PATCH"].includes(method)) {
			const contentType = req.headers["content-type"] || ""

			if (contentType.includes("multipart/form-data")) {
				try {
					const multipartData = await parseMultipartData(req)
					body = multipartData.fields

					const fileKeys = Object.keys(multipartData.files)
					const fileKey =
						fileKeys.find(
							(key) => key.toLowerCase() === "file" || key.toLowerCase() === "csv" || key === "File"
						) || fileKeys[0]

					req.file = fileKey ? multipartData.files[fileKey] : null
				} catch (parseError) {
					throw parseError
				}
			} else {
				body = await parseRequestBody(req)
			}
		}

		const routes = {
			"POST /tasks": () => tasksController.createTask(req, res, body),
			"GET /tasks": () => tasksController.getAllTasks(req, res, queryParams),
			[`GET /tasks/${id}`]: () => tasksController.getTaskById(req, res, id),
			[`PUT /tasks/${id}`]: () => tasksController.updateTask(req, res, id, body),
			[`DELETE /tasks/${id}`]: () => tasksController.deleteTask(req, res, id),
			[`PATCH /tasks/${id}/complete`]: () => tasksController.toggleTaskComplete(req, res, id),
			"POST /tasks/import": () => tasksController.importTasksFromCSV(req, res, body),
		}

		const handler = routes[`${method} ${route}`]

		if (handler) {
			await handler()
		} else {
			res.writeHead(404, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "Route not found" }))
		}
	} catch (error) {
		res.writeHead(500, { "Content-Type": "application/json" })
		res.end(
			JSON.stringify({
				error: "Internal server error",
				details: error.message,
			})
		)
	}
}
