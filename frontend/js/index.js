document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.querySelector("form");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // Prevent default form reload

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    try {
      
      const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        window.location.href = data.redirectUrl;
      } else {
        alert(data.message || "Invalid login credentials");
      }
    } catch (error) {
      console.log("Login error:", error);
      alert("Something went wrong. Please try again later.");
    }
  });
});
