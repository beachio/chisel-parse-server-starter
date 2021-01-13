FROM node:14.13.0

RUN mkdir parse

ADD . /parse
WORKDIR /parse
RUN yarn install

EXPOSE 1337

RUN export NODE_PATH=/parse/node_modules
# Uncomment if you want to access cloud code outside of your container
# A main.js file must be present, if not Parse will not start

# VOLUME /parse/cloud
CMD yarn run updateConfAndStart
