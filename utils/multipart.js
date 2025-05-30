export function parseMultipartData(req) {
	return new Promise((resolve, reject) => {
		const contentType = req.headers["content-type"] || ""
		const boundary = contentType.split("boundary=")[1]

		if (!boundary) {
			return reject(new Error("No boundary found"))
		}

		const chunks = []

		req.on("data", (chunk) => {
			chunks.push(chunk)
		})

		req.on("end", () => {
			try {
				const buffer = Buffer.concat(chunks)

				const dataString = buffer.toString("utf8")

				const parts = dataString.split(`--${boundary}`)

				const result = { fields: {}, files: {} }

				for (let i = 0; i < parts.length; i++) {
					const part = parts[i].trim()

					if (!part.includes("Content-Disposition")) {
						continue
					}

					const [rawHeaders, ...bodyParts] = part.split(/\r?\n\r?\n/)
					const body = bodyParts.join("\n").replace(/\r?\n--$/, "")

					const nameMatch = rawHeaders.match(/name="([^"]+)"/)
					const filenameMatch = rawHeaders.match(/filename="([^"]+)"/)

					if (!nameMatch) continue

					const fieldName = nameMatch[1]

					if (filenameMatch) {
						const filename = filenameMatch[1]

						result.files[fieldName] = {
							filename: filename,
							buffer: Buffer.from(body, "utf8"),
							data: body,
						}
					} else {
						result.fields[fieldName] = body
					}
				}

				resolve(result)
			} catch (error) {
				reject(error)
			}
		})

		req.on("error", (error) => {
			reject(error)
		})
	})
}
