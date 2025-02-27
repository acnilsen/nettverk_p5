const http = require("http");
const fs = require("fs").promises;
const { exec } = require("child_process");
const path = require("path");

const host = "localhost";
const port = 8000;
const pythonCompileDir = path.join(__dirname, "python_compile");
const mainPyPath = path.join(pythonCompileDir, "main.py");

let indexFile;

const requestListener = async (req, res) => {
  if (req.method === "GET") {
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.writeHead(200);
      res.end(indexFile);
    } else {
      error(res, 404, "Resource not found");
    }
  } else if (req.method === "POST") {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api") {
      let body = "";
      req.on("data", (chunk) => (body += chunk.toString()));
      req.on("end", async () => {
        console.log("Raw body received:", body);
        try {
          const parsedData = JSON.parse(body);
          console.log("Parsed data:", parsedData);
          const { code } = parsedData;
          if (!code) return error(res, 400, "No code provided");
          
          await fs.writeFile(mainPyPath, code);
          
          exec(`docker build "${pythonCompileDir}" -t python_runner`, (buildError, buildOutput) => {
            if (buildError) return error(res, 400, buildError.toString());
            
            exec("docker run --rm python_runner", (runError, runOutput) => {
              if (runError) return error(res, 400, runError.toString());
              res.writeHead(200);
              res.end(JSON.stringify({ result: runOutput }));
            });
          });
        } catch (e) {
          console.error("JSON parsing error:", e);
          error(res, 400, "Invalid JSON data received");
        }
      });
    } else {
      error(res, 404, "Resource not found");
    }
  }
};

const error = (res, code, text) => {
  console.error(`Error ${code}: ${text}`);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: text }));
};

const server = http.createServer(requestListener);

fs.readFile(path.join(__dirname, "index.html"))
  .then((contents) => {
    indexFile = contents;
    server.listen(port, host, () => {
      console.log(`Server running at http://${host}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Could not read index.html file:", err);
    process.exit(1);
  });