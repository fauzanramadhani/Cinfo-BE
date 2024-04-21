FROM node:slim

WORKDIR /src/app

COPY package*.json /src/app/

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]