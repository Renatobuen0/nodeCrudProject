import { promises as fs } from "fs"

export function getCurrentDate() {
	return new Date().toISOString()
}

export function parseRequestBody(req) {
	return new Promise((resolve, reject) => {
		let body = ""
		req.on("data", (chunk) => {
			body += chunk.toString()
		})
		req.on("end", () => {
			try {
				resolve(JSON.parse(body))
			} catch (error) {
				reject(error)
			}
		})
	})
}

export function parseCSV(csvData) {
	const lines = csvData.split("\n")
	const headers = lines[0].split(",").map((h) => h.trim())
	const result = []

	for (let i = 1; i < lines.length; i++) {
		if (!lines[i].trim()) continue

		const obj = {}
		const currentline = lines[i].split(",")

		for (let j = 0; j < headers.length; j++) {
			obj[headers[j]] = currentline[j] ? currentline[j].trim() : ""
		}

		result.push(obj)
	}

	return result
}
