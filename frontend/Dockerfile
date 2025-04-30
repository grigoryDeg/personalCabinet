FROM nginx:alpine

COPY . /usr/share/nginx/html/
RUN chmod -R 644 /usr/share/nginx/html/css/*.css
RUN chmod 755 /usr/share/nginx/html/css

EXPOSE 80