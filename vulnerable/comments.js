const paint_id = 2;

const form = document.getElementById("commentForm");
const container = document.getElementById("commentsContainer");

async function loadComments() {

    const res = await fetch(`/api/comments`);
    const comments = await res.json();

    container.innerHTML = "";

    comments.forEach(c => {

        container.innerHTML += `
        <div class="comment">
            <strong>${c.username}</strong>
            <p>${c.comment}</p>
        </div>
        `;

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