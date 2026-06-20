let form = document.querySelector("form");

form.addEventListener("submit", function(event) {
    event.preventDefault();
    alert("Login Successful");
    window.location.href = "../home/home.html";
});