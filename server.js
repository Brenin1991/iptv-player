const express = require("express");
const path = require("path");
const fs = require("fs");
const m3u8Parser = require("m3u8-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");
const xml2js = require("xml2js");

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

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
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

app.get("/streams", async (req, res) => {
  try {
    const streams = await lerListaM3U("assets/lista.m3u");
    res.json(streams);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar os streams" });
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

        // Cria um mapa de canais com a ID
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
    const programacao = await lerListaXMLTV("assets/prog.xml");
    res.json(programacao);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar a programação" });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${port}`);
});
