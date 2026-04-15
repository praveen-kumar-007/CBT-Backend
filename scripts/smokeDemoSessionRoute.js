const app = require("../src/app");

const run = async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const request = async (method) => {
      const response = await fetch(`${baseUrl}/api/auth/student/demo-session`, {