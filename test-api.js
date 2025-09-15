// Test script for the API server

const testAPI = async () => {
  try {
    console.log("Testing API server...");

    // Test health endpoint
    const healthResponse = await fetch("http://localhost:3002/health");
    const healthData = await healthResponse.json();
    console.log("Health check:", healthData);

    // Test settings endpoint
    const settingsResponse = await fetch("http://localhost:3002/api/settings");
    const settingsData = await settingsResponse.json();
    console.log("Settings:", settingsData);

    // Test sync endpoint
    const syncResponse = await fetch(
      "http://localhost:3002/api/sync/run-once",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );
    const syncData = await syncResponse.json();
    console.log("Sync test:", syncData);

    // Test email endpoint with custom email
    const emailResponse = await fetch("http://localhost:3002/api/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@primestyle.com" }),
    });
    const emailData = await emailResponse.json();
    console.log("Email test:", emailData);
  } catch (error) {
    console.error("Error testing API:", error);
  }
};

testAPI();
