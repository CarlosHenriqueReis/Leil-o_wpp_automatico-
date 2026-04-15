FROM node:18-alpine

# Instala git para algumas dependências do node (e.g. tarballs/pacotes github)
RUN apk add --no-cache git

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Usaremos o IP do gateway padrão do docker no windows ou o nome especial para acessar a porta 3000
ENV WEBHOOK_URL="http://host.docker.internal:3000/api/webhook/baileys"

CMD ["npm", "start"]
