FROM node:16-alpine AS builder

WORKDIR /app
COPY package*.json .
RUN npm ci

COPY ghu.js .
COPY src src

COPY passhash.txt .
RUN sed -i "s#\"passhash\":.*#\"passhash\": \"$(head -1 passhash.txt)\",#g" src/_h5ai/private/conf/options.json

RUN npm run build

FROM php:8.1.7-apache-buster

RUN apt update && apt install -y --no-install-recommends \
  unzip \
  zip

RUN apt install -y libpng-dev zip graphicsmagick ffmpeg libpng-dev libjpeg-dev libfreetype6-dev zlib1g-dev libzip-dev
RUN docker-php-ext-configure gd --with-freetype=/usr/include/ --with-jpeg=/usr/include/
RUN docker-php-ext-install gd
RUN docker-php-ext-configure exif
RUN docker-php-ext-install exif
RUN docker-php-ext-install zip

RUN rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/build/_h5ai ./_h5ai

RUN chown www-data _h5ai/private/cache _h5ai/public/cache

COPY ./httpd-h5ai.conf /etc/apache2/sites-enabled/h5ai.conf
