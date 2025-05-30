import { promises as fs } from "fs"
import { randomUUID } from "crypto"
import { parseCSV, getCurrentDate } from "../utils/helpers.js"

const DATA_FILE = "./tasks.json"

let tasks = []

async function loadTasks() {
	try {
		const data = await fs.readFile(DATA_FILE, "utf8")
		tasks = JSON.parse(data)
	} catch (error) {
		if (error.code === "ENOENT") {
			await saveTasks()
		}
	}
}

async function saveTasks() {
	try {
		await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2))
	} catch (error) {
		throw error
	}
}

function sendResponse(res, statusCode, data) {
	res.writeHead(statusCode, { "Content-Type": "application/json" })
	res.end(JSON.stringify(data))
}

function sendError(res, statusCode, message, details = null) {
	const errorObj = { error: message }
	if (details) errorObj.details = details
	sendResponse(res, statusCode, errorObj)
}

function validateTaskInput(body) {
	const { title, description } = body
	const errors = []

	if (!title?.trim()) errors.push("Title is required")
	if (!description?.trim()) errors.push("Description is required")

	return errors
}

await loadTasks()

export async function createTask(req, res, body) {
	const errors = validateTaskInput(body)
	if (errors.length > 0) {
		return sendError(res, 400, "Validation failed", errors)
	}

	const newTask = {
		id: randomUUID(),
		title: body.title.trim(),
		description: body.description.trim(),
		completed_at: null,
		created_at: getCurrentDate(),
		updated_at: getCurrentDate(),
	}

	tasks.push(newTask)

	try {
		await saveTasks()
		sendResponse(res, 201, newTask)
	} catch (error) {
		sendError(res, 500, "Failed to save task", error.message)
	}
}

export async function getAllTasks(req, res, queryParams) {
	const search = queryParams?.get("search")?.trim()
	const status = queryParams?.get("status")
	const limit = parseInt(queryParams?.get("limit")) || null

	let filteredTasks = tasks

	if (status === "completed") {
		filteredTasks = filteredTasks.filter((task) => task.completed_at)
	} else if (status === "pending") {
		filteredTasks = filteredTasks.filter((task) => !task.completed_at)
	}

	if (search) {
		const searchTerm = search.toLowerCase()
		filteredTasks = filteredTasks.filter(
			(task) =>
				task.title.toLowerCase().includes(searchTerm) || task.description.toLowerCase().includes(searchTerm)
		)
	}

	if (limit && limit > 0) {
		filteredTasks = filteredTasks.slice(0, limit)
	}

	filteredTasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

	sendResponse(res, 200, {
		tasks: filteredTasks,
		total: filteredTasks.length,
		filters: { search, status, limit },
	})
}

export async function getTaskById(req, res, id) {
	if (!id?.trim()) {
		return sendError(res, 400, "Task ID is required")
	}

	const task = tasks.find((t) => t.id === id)

	if (!task) {
		return sendError(res, 404, "Task not found")
	}

	sendResponse(res, 200, task)
}

export async function updateTask(req, res, id, body) {
	if (!id?.trim()) {
		return sendError(res, 400, "Task ID is required")
	}

	const task = tasks.find((t) => t.id === id)
	if (!task) {
		return sendError(res, 404, "Task not found")
	}

	const { title, description } = body

	if (title !== undefined && !title?.trim()) {
		return sendError(res, 400, "Title cannot be empty")
	}
	if (description !== undefined && !description?.trim()) {
		return sendError(res, 400, "Description cannot be empty")
	}

	if (title !== undefined) task.title = title.trim()
	if (description !== undefined) task.description = description.trim()
	task.updated_at = getCurrentDate()

	try {
		await saveTasks()
		sendResponse(res, 200, task)
	} catch (error) {
		sendError(res, 500, "Failed to update task", error.message)
	}
}

export async function deleteTask(req, res, id) {
	if (!id?.trim()) {
		return sendError(res, 400, "Task ID is required")
	}

	const taskIndex = tasks.findIndex((t) => t.id === id)
	if (taskIndex === -1) {
		return sendError(res, 404, "Task not found")
	}

	const deletedTask = tasks[taskIndex]
	tasks.splice(taskIndex, 1)

	try {
		await saveTasks()
		res.writeHead(204)
		res.end()
	} catch (error) {
		tasks.splice(taskIndex, 0, deletedTask)
		sendError(res, 500, "Failed to delete task", error.message)
	}
}

export async function toggleTaskComplete(req, res, id) {
	if (!id?.trim()) {
		return sendError(res, 400, "Task ID is required")
	}

	const task = tasks.find((t) => t.id === id)
	if (!task) {
		return sendError(res, 404, "Task not found")
	}

	task.completed_at = task.completed_at ? null : getCurrentDate()
	task.updated_at = getCurrentDate()

	try {
		await saveTasks()
		sendResponse(res, 200, task)
	} catch (error) {
		sendError(res, 500, "Failed to update task", error.message)
	}
}

export async function importTasksFromCSV(req, res, body) {
	let csvData = null

	if (body.csvData?.trim()) {
		csvData = body.csvData.trim()
	} else if (req.file) {
		try {
			if (req.file.buffer) {
				csvData = req.file.buffer.toString("utf8")
			} else if (req.file.data) {
				csvData = req.file.data
			}
		} catch (error) {
			return sendError(res, 400, "Error reading uploaded file")
		}
	} else if (body.filePath?.trim()) {
		try {
			csvData = await fs.readFile(body.filePath, "utf8")
		} catch (error) {
			return sendError(res, 404, "CSV file not found at specified path")
		}
	}

	if (!csvData?.trim()) {
		return sendError(res, 400, "CSV data is required. Send as 'csvData' field, file upload, or 'filePath'")
	}

	try {
		const parsedData = parseCSV(csvData.trim())

		if (!Array.isArray(parsedData) || parsedData.length === 0) {
			return sendError(res, 400, "CSV data is empty or invalid")
		}

		const newTasks = parsedData
			.filter((item) => item.title?.trim())
			.map((item) => ({
				id: randomUUID(),
				title: item.title.trim(),
				description: item.description?.trim() || "",
				completed_at: null,
				created_at: getCurrentDate(),
				updated_at: getCurrentDate(),
			}))

		if (newTasks.length === 0) {
			return sendError(res, 400, "No valid tasks found in CSV. Make sure your CSV has a 'title' column.")
		}

		tasks = tasks.concat(newTasks)
		await saveTasks()

		sendResponse(res, 201, {
			message: `${newTasks.length} tasks imported successfully`,
			imported: newTasks.length,
			skipped: parsedData.length - newTasks.length,
			tasks: newTasks,
		})
	} catch (error) {
		sendError(res, 500, "Error processing CSV data", error.message)
	}
}
