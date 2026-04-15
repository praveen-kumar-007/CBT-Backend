const app = require("../src/app");

const run = async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const request = async (method) => {
      const response = await fetch(`${baseUrl}/api/auth/student/demo-session`, {
        method,
        headers: {
          "content-type": "application/json",
        },
      });

      return { method, status: response.status };
    };

    const results = await Promise.all([
      request("GET"),
      request("POST"),
      request("OPTIONS"),
    ]);

    results.forEach((result) => {
      console.log(
        `${result.method} /api/auth/student/demo-session -> ${result.status}`,
      );
    });

    const notFound = results.find((result) => result.status === 404);
    if (notFound) {
      console.error("Smoke check failed: demo-session route returned 404.");
      process.exitCode = 1;
      return;
    }

    console.log("Smoke check passed: demo-session route is reachable.");
  } catch (error) {
    console.error("Smoke check failed with runtime error:", error);
    process.exitCode = 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

run();
