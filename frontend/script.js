
const icon = document.getElementById("icon");
icon.onclick = () => {
    document.body.classList.toggle("dark-theme");
    if (document.body.classList.contains("dark-theme")) {
        icon.src = "dark_theme/sun.png"
    } else {
        icon.src = "dark_theme/moon.png"
    }
}


let projectTitle = "";
let dataEntry = [];
document.getElementById('projectTitleForm').addEventListener('submit', function (e) {
    e.preventDefault();
    projectTitle = document.getElementById('projectTitle').value;
    document.getElementById('dataEntry').style.display = 'block';
    this.style.display = 'none';
});


document.getElementById('levelingDataForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const pointId = parseInt(document.getElementById('pointId').value);
    const backSight = parseFloat(document.getElementById('backSight').value);
    const intermediateSight = parseFloat(document.getElementById('intermediateSight').value);
    const foreSight = parseFloat(document.getElementById('foreSight').value);
    const distance = document.getElementById('distance').value;
    const comments = document.getElementById('comments').value;
    dataEntry.push({
        pointId, backSight, intermediateSight, foreSight, distance, comments
    });

    document.getElementById("levelingDataForm").reset();

    const response = await fetch('http://localhost:3000/leveling_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectTitle, dataEntry })
    });

    const data = await response.json();
    console.log(data);
});



// document.getElementById('downloadCsv').addEventListener('click', async () => {
//     const response = await fetch('http://localhost:3000/download_csv');
//     const blob = await response.blob();
//     const url = window.URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.style.display = 'none';
//     a.href = url;
//     a.download = 'leveling_data.csv';
//     document.body.appendChild(a);
//     a.click();
//     window.URL.revokeObjectURL(url);
// })


document.getElementById('downloadCsv').addEventListener('click', function () {
    fetch('http://localhost:3000/download_csv', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectTitle, dataEntry }),
    })
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${projectTitle}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        });
});
