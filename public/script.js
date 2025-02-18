/*
    https://github.com/Brenin1991
    https://bnlabs.com.br
*/

var video = document.getElementById("iptvPlayer");

let groups = {};
let loadData;
let programacaoData = [];

function loadStream(url) {
    if (Hls.isSupported()) {
        var hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
    }
}

function loadChannels() {
    fetch("/streams")
        .then((response) => response.json())
        .then((data) => {
            loadData = data;
            const channelsDiv = document.getElementById("channelsContainer");

            loadData.forEach((stream) => {
                if (!groups[stream.group]) {
                    groups[stream.group] = [];
                }
                groups[stream.group].push(stream);
            });

            Object.keys(groups).forEach((group) => {
                const groupDiv = document.createElement("div");
                groupDiv.classList.add("group");

                const groupHeader = document.createElement("h2");
                groupHeader.textContent = group;
                groupHeader.classList.add("group-title");
                groupHeader.onclick = function () {
                    const allGroups = document.querySelectorAll(".group");
                    allGroups.forEach((group) =>
                        group.classList.remove("selected")
                    );

                    toggleChannelList(group);
                    groupDiv.classList.add("selected");
                };

                groupDiv.appendChild(groupHeader);
                channelsDiv.appendChild(groupDiv);
            });

            loadProgramacao();
        })
        .catch((error) => {
            console.error("Erro ao carregar os canais:", error);
        });
}

function toggleChannelList(group) {
    const channelList = document.getElementById("channel-list");

    channelList.replaceChildren();

    groups[group].forEach((stream) => {
        const channelDiv = document.createElement("div");
        channelDiv.classList.add("channel");

        const logo = document.createElement("img");
        logo.src = stream.logo;
        logo.alt = stream.name;
        logo.classList.add("channel-logo");

        const name = document.createElement("h3");
        name.textContent = stream.name;
        name.classList.add("channel-name");
        channelDiv.onclick = function () {
            const allGroups = document.querySelectorAll(".channel");
            allGroups.forEach((group) => {
                if (group !== channelDiv) {
                    group.classList.remove("selected");
                }
            });

            if (!channelDiv.classList.contains("selected")) {
                loadStream(stream.url);
                setUpProgramacao(stream.id);
                channelDiv.classList.add("selected");
            }
        };

        const vivo = document.createElement("div");
        vivo.textContent = "AO VIVO";
        vivo.classList.add("vivo");
        channelDiv.appendChild(logo);
        channelDiv.appendChild(name);
        channelDiv.appendChild(vivo);
        channelList.appendChild(channelDiv);
    });
}

function loadProgramacao() {
    fetch("/programacao")
        .then((response) => response.json())
        .then((data) => {
            programacaoData = data;
        })
        .catch((error) => {
            console.error("Erro ao carregar a programação:", error);
        });
}

function normalizeName(name) {
    return name.replace(/\s+/g, '').replace(/[^\w\s]/g, '').toLowerCase();
}


function setUpProgramacao(canal) {
    console.log(canal);

    const programacaoDiv = document.getElementById("programacao");

    const canalProgramacao = programacaoData.filter(
        (prog) => normalizeName(prog.canal) === normalizeName(canal)
    );

    const now = moment();

    canalProgramacao.sort((a, b) =>
        moment(a.inicio, "DD/MM/YYYY HH:mm:ss").isBefore(
            moment(b.inicio, "DD/MM/YYYY HH:mm:ss")
        )
            ? -1
            : 1
    );

    programacaoDiv.innerHTML = "";

    canalProgramacao.forEach((prog) => {
        const start = moment(prog.inicio, "DD/MM/YYYY HH:mm:ss");
        const end = moment(prog.fim, "DD/MM/YYYY HH:mm:ss");

        if (start.isBefore(now) && end.isAfter(now)) {
            createProgramDiv(prog, true, now, start, end);
        } else if (start.isAfter(now)) {
            createProgramDiv(prog, false);
        }
    });

    function createProgramDiv(prog, isCurrent, now, start, end) {
        const progDiv = document.createElement("div");
        progDiv.classList.add("programa");

        if (isCurrent) {
            progDiv.classList.add("programa-atual");
        } else {
            progDiv.classList.add("programa-proximo");
        }

        const titulo = document.createElement("h4");
        titulo.textContent = prog.programa;
        progDiv.appendChild(titulo);

        const descricao = document.createElement("p");
        descricao.textContent = prog.descricao;
        progDiv.appendChild(descricao);

        const horario = document.createElement("p");
        horario.textContent = `Início: ${prog.inicio} | Fim: ${prog.fim}`;
        progDiv.appendChild(horario);

        const rating = document.createElement("p");
        progDiv.appendChild(rating);
        setRating(prog, rating);

        if (isCurrent) {
            const progressBarContainer = document.createElement("div");
            progressBarContainer.classList.add("progress-bar-container");

            const progressBar = document.createElement("div");
            progressBar.classList.add("progress-bar");

            const duration = end.diff(start);
            const elapsed = now.diff(start);

            const progress = Math.min((elapsed / duration) * 100, 100);
            progressBar.style.width = `${progress}%`;

            progressBarContainer.appendChild(progressBar);
            progDiv.appendChild(progressBarContainer);

            const interval = setInterval(() => {
                const newElapsed = moment().diff(start);
                const newProgress = Math.min((newElapsed / duration) * 100, 100);
                progressBar.style.width = `${newProgress}%`;

                if (newProgress >= 100) {
                    clearInterval(interval);
                    setUpProgramacao(canal);
                }
            }, 1000);
        }

        programacaoDiv.appendChild(progDiv);
    }
}

function setRating(programacao, rating) {
    if (programacao.rating !== undefined && programacao.rating !== null) {
        const valorRating = String(programacao.rating).replace(/\[|\]/g, "");

        rating.textContent = `Classificação: `;

        const colorDiv = document.createElement("div");
        colorDiv.style.width = "30px";
        colorDiv.style.height = "30px";
        colorDiv.style.display = "inline-flex";
        colorDiv.style.alignItems = "center";
        colorDiv.style.justifyContent = "center";
        colorDiv.style.marginLeft = "10px";
        colorDiv.style.borderRadius = "4px";
        colorDiv.style.color = "white";
        colorDiv.style.fontWeight = "bold";

        switch (valorRating.toLowerCase()) {
            case "l":
                colorDiv.style.backgroundColor = "green";
                break;
            case "10":
                colorDiv.style.backgroundColor = "blue";
                break;
            case "12":
                colorDiv.style.backgroundColor = "yellow";
                colorDiv.style.color = "black";
                break;
            case "14":
                colorDiv.style.backgroundColor = "orange";
                break;
            case "16":
                colorDiv.style.backgroundColor = "red";
                break;
            case "18":
                colorDiv.style.backgroundColor = "darkred";
                break;
        }

        colorDiv.textContent = valorRating;

        rating.appendChild(colorDiv);
    } else {
        rating.textContent = "Classificação: Não disponível";
    }
}

function toggleDashControl() {
    const dashControl = document.getElementById("dash-control");
    dashControl.classList.toggle("active");
    const topbar = document.getElementById("topbar");
    topbar.classList.toggle("active");
    getWeather();
}

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        toggleDashControl();
    }
});

window.addEventListener("load", () => {
    const dashControl = document.getElementById("dash-control");
});

window.onload = loadChannels;

function updateDateTime() {
    const date = new Date();
    const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    };
    const timeString = date.toLocaleTimeString();
    const dateString = date.toLocaleDateString("pt-BR", options);

    document.getElementById("time").innerText =
        timeString;
    document.getElementById("date").innerText =
        dateString;
}

async function getWeather() {
    const apiKey = "955063c20b55d4a3d8e45d166c55524d";
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=Curitiba&appid=${apiKey}&lang=pt_br&units=metric`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        const temp = data.main.temp;
        document.getElementById("weather").innerText = `${temp}°C`;
    } catch (error) {
        document.getElementById("weather").innerText =
            "Erro ao obter a previsão do tempo";
    }
}

setInterval(updateDateTime, 1000);
getWeather();