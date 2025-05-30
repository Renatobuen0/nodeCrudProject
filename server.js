import http from "http"
import tasksRoutes from "./routes/taskRoutes.js"

const PORT = 3000

const server = http.createServer(async (req, res) => {
	await tasksRoutes(req, res)
})

server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`)
})
