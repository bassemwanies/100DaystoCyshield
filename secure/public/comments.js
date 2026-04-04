const paint_id = 2;

const form = document.getElementById("commentForm");
const container = document.getElementById("commentsContainer");

async function loadComments() {

    const res = await fetch(`/api/comments`);
    const comments = await res.json();

    container.innerHTML = "";

    comments.forEach(c => {
        const div = document.createElement("div");
        div.className = "comment";

        const strong = document.createElement("strong");
        strong.innerText = c.username;
        const p = document.createElement("p");
        p.innerText = c.comment;
        div.appendChild(strong);
        div.appendChild(p);
        container.appendChild(div);
    });

}

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const username = document.getElementById("username").value;
    const comment = document.getElementById("comment").value;

    await fetch("/api/comments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            paint_id,
            username,
            comment
        })
    });

    form.reset();
    loadComments();

});

loadComments();