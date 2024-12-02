const express = require("express");
const path = require("path");
const fs = require("fs");
const m3u8Parser = require("m3u8-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");
const xml2js = require("xml2js");

const app = express();
const port = 3000;
const moment = require('moment');

// Proxy para o stream (não muda a lógica de ler o arquivo M3U, apenas lida com requisições de streaming)
app.use(
  "/proxy",
  createProxyMiddleware({
    target: "https://cr7v.short.gy",
    changeOrigin: true,
    pathRewrite: {
      "^/proxy": "", // Reescreve a URL para o servidor de destino
    },
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader("Access-Control-Allow-Origin", "*");
    },
  })
);

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// Rota principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Função para ler o arquivo M3U
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
        const title = segment.title || ""; // Verificação de título
        const name = title.match(/tvg-id="([^"]+)"/)?.[1] || "Desconhecido";
        const group = title.match(/group-title="([^"]+)"/)?.[1] || "Sem grupo";
        const logo = title.match(/tvg-logo="([^"]+)"/)?.[1] || "";

        streams.push({
          name: name || "Desconhecido",
          url: segment.uri,
          group: group,
          logo: logo,
        });
      });

      resolve(streams); // Resolver com a lista de streams
    });
  });
}

// Rota para listar os streams a partir do arquivo M3U
app.get("/streams", async (req, res) => {
  try {
    const streams = await lerListaM3U("lista.m3u"); // Certifique-se de que o arquivo 'lista.m3u' está no caminho correto
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
        const canais = result.tv.channel || []; // Pega todos os canais
        const programas = result.tv.programme || []; // Pega todos os programas

        // Cria um mapa de canais com a ID
        const canaisMap = canais.reduce((map, channel) => {
          const channelId = channel["$"]?.id; // A ID do canal
          const channelName = channel["display-name"]?.[0]?._; // Nome do canal

          // Verifica se o nome do canal e a ID são válidos
          if (channelId && channelName) {
            map[channelId] = channelName;
          } else {
            console.log("Erro ao processar o canal:", channel);
          }
          return map;
        }, {});

        // Associa cada programa ao seu canal usando a ID
        programas.forEach((programa) => {
          const channelId = programa["$"]?.channel; // ID do canal
          const channelName = canaisMap[channelId]; // Nome do canal pela ID
          
          if (channelName) {
            const start = programa['$']?.start || 'Sem horário';
            const stop = programa['$']?.stop || 'Sem horário';
            const rating = programa.rating?.[0]?.value || 'Sem classificação'; // Extraindo o rating

            // Formatar as datas de início e fim usando moment, considerando o fuso horário
            const startFormatted = moment(start, 'YYYYMMDDHHmmss Z').format('DD/MM/YYYY HH:mm:ss');
            const stopFormatted = moment(stop, 'YYYYMMDDHHmmss Z').format('DD/MM/YYYY HH:mm:ss');

            programacao.push({
              canal: channelName,
              programa: programa.title?.[0]?.['_'] || 'Sem título', // Acessa o valor de título
              descricao: programa.desc?.[0]?.['_'] || 'Sem descrição', // Acessa a descrição do programa
              inicio: startFormatted, // Horário de início formatado
              fim: stopFormatted, // Horário de fim formatado
              rating: rating // Adiciona o rating

            });            
          } else {
            console.log("Programa sem canal válido:", programa);
          }
        });

        resolve(programacao); // Resolver com a lista de programação
      });
    });
  });
}

// Rota para listar a programação
app.get("/programacao", async (req, res) => {
  try {
    const programacao = await lerListaXMLTV("prog.xml"); // Certifique-se de que o arquivo XMLTV está no caminho correto
    res.json(programacao);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar a programação" });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${port}`);
});
