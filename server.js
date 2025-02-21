const express = require("express");
const path = require("path");
const fs = require("fs");
const m3u8Parser = require("m3u8-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");
const xml2js = require("xml2js");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");

const app = express();
const port = 3000;
const moment = require('moment');

app.use(
  "/proxy",
  createProxyMiddleware({
    target: "https://cr7v.short.gy",
    changeOrigin: true,
    pathRewrite: {
      "^/proxy": "",
    },
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader("Access-Control-Allow-Origin", "*");
    },
  })
);

const pastaListas = path.join(__dirname, "listas");
if (!fs.existsSync(pastaListas)) {
  fs.mkdirSync(pastaListas, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "src")));
app.use("/listas", express.static(path.join(__dirname, "listas")));
app.use("/icons", express.static(path.join(__dirname, "assets/icons")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "src", "index.html"));
});

function lerListaM3U(caminhoArquivo) {
  return new Promise((resolve, reject) => {
    fs.readFile(caminhoArquivo, "utf8", (err, data) => {
      if (err) {
        reject("Erro ao ler o arquivo M3U");
        return;
      }

      const parser = new m3u8Parser.Parser();
      parser.push(data);
      parser.end();

      const playlist = parser.manifest;
      const streams = [];

      playlist.segments.forEach((segment) => {
        const title = segment.title || "";

        const nameMatch = title.match(/,([^,]+)(?=\s*$)/);

        const name = nameMatch ? nameMatch[1].trim() : "Desconhecido";
        const id = title.match(/tvg-id="([^"]+)"/)?.[1] || "Desconhecido";

        const logo = title.match(/tvg-logo="([^"]+)"/)?.[1] || "";

        const group = title.match(/group-title="([^"]+)"/)?.[1] || "Sem grupo";

        streams.push({
          id: id,
          name: name,
          url: segment.uri,
          group: group,
          logo: logo,
        });
      });

      resolve(streams);
    });
  });
}

app.get("/streams/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    db.get("SELECT lista_m3u FROM usuarios WHERE id = ?", [userId], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao buscar usuário no banco de dados" });
      }

      if (!row) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const nomeArquivo = row.lista_m3u;

      const caminhoArquivo = path.join(__dirname, "listas", nomeArquivo);

      try {
        const streams = await lerListaM3U(caminhoArquivo);
        res.json(streams);
      } catch (error) {
        res.status(500).json({ error: "Erro ao carregar os streams da lista" });
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar streams" });
  }
});


function lerListaXMLTV(caminhoArquivo) {
  return new Promise((resolve, reject) => {
    fs.readFile(caminhoArquivo, "utf8", (err, data) => {
      if (err) {
        reject("Erro ao ler o arquivo XMLTV");
        return;
      }

      xml2js.parseString(data, (err, result) => {
        if (err) {
          reject("Erro ao analisar o XMLTV");
          return;
        }

        const programacao = [];
        const canais = result.tv.channel || [];
        const programas = result.tv.programme || [];

        const canaisMap = canais.reduce((map, channel) => {
          const channelId = channel["$"]?.id;
          const channelName = channel["display-name"]?.[0]?._;

          if (channelId && channelName) {
            map[channelId] = channelName;
          } else {
            console.log("Erro ao processar o canal:", channel);
          }
          return map;
        }, {});

        programas.forEach((programa) => {
          const channelId = programa["$"]?.channel;
          const channelName = canaisMap[channelId];

          if (channelName) {
            const start = programa['$']?.start || 'Sem horário';
            const stop = programa['$']?.stop || 'Sem horário';
            const rating = programa.rating?.[0]?.value || 'Sem classificação';

            const startFormatted = moment(start, 'YYYYMMDDHHmmss Z').format('DD/MM/YYYY HH:mm:ss');
            const stopFormatted = moment(stop, 'YYYYMMDDHHmmss Z').format('DD/MM/YYYY HH:mm:ss');

            programacao.push({
              canal: channelName,
              programa: programa.title?.[0]?.['_'] || 'Sem título',
              descricao: programa.desc?.[0]?.['_'] || 'Sem descrição',
              inicio: startFormatted,
              fim: stopFormatted,
              rating: rating
            });
          } else {
            console.log("Programa sem canal válido:", programa);
          }
        });

        resolve(programacao);
      });
    });
  });
}

app.get("/programacao", async (req, res) => {
  try {
    const programacao = await lerListaXMLTV("src/progs/prog.xml");
    res.json(programacao);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar a programação" });
  }
});

const db = new sqlite3.Database("usuarios.db", (err) => {
  if (err) {
    console.error("Erro ao conectar ao banco de dados:", err.message);
  } else {
    console.log("Banco de dados conectado.");

    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        lista_m3u TEXT NOT NULL,
        icone TEXT NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error("Erro ao criar ou alterar a tabela:", err.message);
      } else {
        console.log("Tabela 'usuarios' criada ou atualizada com sucesso.");
      }
    });
  }
});

async function validarEGuardarM3U(url) {
  try {
    console.log(`Baixando lista de: ${url}`);

    const resposta = await axios.get(url, { timeout: 10000 }); // 10s de timeout

    if (!resposta.data.includes("#EXTINF")) throw new Error("Lista M3U inválida");

    const nomeArquivo = `lista_${Date.now()}_${Math.floor(Math.random() * 10000)}.m3u`;
    const caminhoArquivo = path.join(pastaListas, nomeArquivo);

    fs.writeFileSync(caminhoArquivo, resposta.data, "utf8");

    console.log(`Lista salva em: ${caminhoArquivo}`);
    return nomeArquivo;
  } catch (err) {
    console.error("Erro ao baixar a lista:", err.message);
    throw new Error(`Erro ao baixar a lista M3U: ${err.message}`);
  }
}

app.post("/cadastrar", async (req, res) => {
  const { nome, lista_m3u, icone } = req.body;

  if (!nome || !lista_m3u || !icone) {
    return res.status(400).json({ error: "Nome, URL da lista e ícone são obrigatórios" });
  }

  try {
    const arquivoM3U = await validarEGuardarM3U(lista_m3u);

    db.run(
      "INSERT INTO usuarios (nome, lista_m3u, icone) VALUES (?, ?, ?)",
      [nome, arquivoM3U, icone],
      function (err) {
        if (err) {
          return res.status(500).json({ error: "Erro ao salvar no banco" });
        }
        res.json({ message: "Usuário cadastrado com sucesso!", id: this.lastID });
      }
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


app.get("/usuarios", (req, res) => {
  db.all("SELECT id, nome, icone FROM usuarios", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao buscar usuários" });
    }
    res.json(rows);
  });
});

app.get("/icones", (req, res) => {
  const iconDir = path.join(__dirname, "assets", "icons");
  fs.readdir(iconDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao carregar ícones." });
    }
    const icons = files.filter(file => file.endsWith(".png") || file.endsWith(".jpg"));
    res.json(icons);
  });
});

app.delete('/usuarios/:id', (req, res) => {
  const userId = req.params.id;

  db.run("DELETE FROM usuarios WHERE id = ?", [userId], function(err) {
    if (err) {
      return res.status(500).json({ error: "Erro ao deletar usuário" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    res.json({ message: "Usuário deletado com sucesso!" });
  });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${port}`);
});
