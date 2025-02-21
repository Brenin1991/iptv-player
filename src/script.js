/*
    https://github.com/Brenin1991
    https://bnlabs.com.br
*/

var video = document.getElementById("iptvPlayer");

let groups = {};
let loadData;
let programacaoData = [];

document.getElementById("dashboard").classList.add("hidden");
document.getElementById("config").classList.add("hidden");

function loadStream(url) {
    if (Hls.isSupported()) {
        var hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
    }
}

function loadChannels(userId) {
    fetch(`/streams/${userId}`)
        .then((response) => response.json())
        .then((data) => {
            loadData = data;
            const channelsDiv = document.getElementById("channelsContainer");
            channelsDiv.innerHTML = '';

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
    channelList.innerHTML = '';

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
    const iptvPlayer = document.getElementById("iptvPlayer");
    iptvPlayer.classList.toggle("active");
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
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // Use false para formato 24 horas ou true para 12 horas
    };
    const timeString = date.toLocaleTimeString('pt-BR', timeOptions);
    const dateString = date.toLocaleDateString('pt-BR', options);

    document.getElementById("time").innerText = timeString;
    document.getElementById("date").innerText = dateString;
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

function abrirPopup() {
    document.getElementById("popup").style.display = "flex";
}

function fecharPopup() {
    document.getElementById("popup").style.display = "none";
}

// Função para carregar os ícones disponíveis
function carregarIcones() {
    fetch("/icones")
      .then(response => response.json())
      .then(icons => {
        const iconContainer = document.getElementById("iconContainer");
        icons.forEach(icon => {
          const iconDiv = document.createElement("div");
          iconDiv.classList.add("icon");
          iconDiv.innerHTML = `<img src="/icons/${icon}" alt="${icon}">`;
          iconDiv.onclick = () => selecionarIcone(icon);
          iconContainer.appendChild(iconDiv);
        });
      })
      .catch(error => {
        console.error("Erro ao carregar os ícones:", error);
      });
  }
  
  // Função para selecionar um ícone
  let iconeSelecionado = "";
  function selecionarIcone(icone) {
    iconeSelecionado = icone;
    const selectedIcon = document.querySelector(".selected");
    if (selectedIcon) {
      selectedIcon.classList.remove("selected");
    }
    const newSelectedIcon = document.querySelector(`[alt="${icone}"]`).parentElement;
    newSelectedIcon.classList.add("selected");
  }
  
  // Função de cadastro de usuário
  function cadastrarUsuario() {
    const nome = document.getElementById("nomeUsuario").value;
    const listaM3U = document.getElementById("urlM3U").value;
    
    if (!nome || !listaM3U || !iconeSelecionado) {
      alert("Por favor, preencha todos os campos e escolha um ícone.");
      return;
    }
  
    const usuario = {
      nome: nome,
      lista_m3u: listaM3U,
      icone: iconeSelecionado
    };

    document.getElementById("loadingOverlay").style.display = "flex";
  
    fetch("/cadastrar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(usuario)
    })
    .then(response => response.json())
    .then(data => {
      console.log(data);
      fecharPopup();
      carregarUsuarios();
      document.getElementById("loadingOverlay").style.display = "none";
    })
    .catch(error => {
      console.error("Erro ao cadastrar usuário:", error);
    });
  }
  
  // Chamar a função para carregar ícones ao abrir o pop-up
  carregarIcones();
  

function switchToDashboard() {
    document.getElementById('login').classList.add('fade-out');
    document.getElementById("loadingOverlay").style.display = "flex";
    setTimeout(function() {
      document.getElementById('login').style.display = 'none';
      document.getElementById('dashboard').style.display = 'flex';
      document.getElementById('dashboard').classList.add('active');
      document.getElementById("loadingOverlay").style.display = "none";
    }, 5000);
  }


function switchToLogin() {
    // Adiciona o efeito de fade escuro na tela de login
    document.getElementById('dashboard').classList.add('fade-out');
    document.getElementById("loadingOverlay").style.display = "flex";
    
    // Após o fade escuro, faz a transição para o dashboard
    setTimeout(function() {
      // Esconde a tela de login e mostra o dashboard
      // Recarrega a página
        location.reload();

    }, 1000); // Tempo para a animação do fade escuro (1 segundo)
  }

  async function carregarUsuarios() {
    try {
      const resposta = await fetch("http://localhost:3000/usuarios");
      const usuarios = await resposta.json();
  
      const userContainer = document.getElementById("userContainer");
      userContainer.innerHTML = ""; // Limpa os usuários existentes
  
      usuarios.forEach(usuario => {
        const userDiv = document.createElement("div");
        userDiv.classList.add("user");
        userDiv.onclick = () => exibirAcoesUsuario(usuario);
  
        userDiv.innerHTML = `
          <img src="/icons/${usuario.icone}" alt="${usuario.nome}">
          <p>${usuario.nome}</p>
        `;
  
        userContainer.appendChild(userDiv);
      });
  
      // Adiciona o botão de adicionar usuário no final
      const addUserDiv = document.createElement("div");
      addUserDiv.classList.add("user", "add-user");
      addUserDiv.onclick = addUser;
      addUserDiv.textContent = "+";
      userContainer.appendChild(addUserDiv);
  
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  }
  
  function exibirAcoesUsuario(usuario) {
    // Remover a classe 'selected' de todos os usuários
    document.querySelectorAll('.user').forEach(user => {
      user.classList.remove('selected');
    });

    // Exibir os botões de ação
    const actionButtons = document.getElementById('actionButtons');
    actionButtons.style.display = 'block';
  
    // Atualizar o texto e eventos dos botões
    const enterButton = document.getElementById('enterButton');
    enterButton.textContent = `Entrar com ${usuario.nome}`;
    enterButton.onclick = () => selecionarUsuario(usuario.id, usuario.nome);
  
    const removeButton = document.getElementById('removeButton');
    removeButton.onclick = () => removerUsuario(usuario.id);
  }
  
  async function removerUsuario(id) {
    if (confirm("Tem certeza que deseja remover este usuário?")) {
      try {
        const resposta = await fetch(`http://localhost:3000/usuarios/${id}`, {
          method: 'DELETE',
        });
  
        if (resposta.ok) {
          console.log(`Usuário com ID ${id} removido com sucesso.`);
          carregarUsuarios(); // Recarrega a lista de usuários após a remoção
          document.getElementById('actionButtons').style.display = 'none'; // Esconde os botões de ação
        } else {
          console.error(`Erro ao remover usuário com ID ${id}.`);
        }
      } catch (error) {
        console.error("Erro ao remover usuário:", error);
      }
    }
  }
  

  function selecionarUsuario(id, nome) {
    localStorage.setItem("usuario_id", id);
    localStorage.setItem("usuario_nome", nome);
    mostrarNotificacao(`Usuário ${nome} selecionado!`);
    loadChannels(id);
    switchToDashboard();
    
    // Aqui você pode redirecionar ou carregar outra página
  }

  function addUser() {
    abrirPopup();
  }

  // Carrega os usuários ao carregar a página
  window.onload = carregarUsuarios;

  fecharPopup();

  function mostrarNotificacao(mensagem) {
    const popup = document.getElementById("notificationPopup");
    const messageElement = document.getElementById("notificationMessage");
    messageElement.textContent = mensagem;
    
    popup.style.display = "block"; // Exibe o popup
    
    // Fechar automaticamente após 3 segundos
    setTimeout(() => {
      fecharNotificacao();
    }, 3000);
  }

  // Fecha a notificação manualmente ao clicar no "X"
  function fecharNotificacao() {
    const popup = document.getElementById("notificationPopup");
    popup.style.display = "none";
  }
  