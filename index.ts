import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import http from 'http';
import cors from 'cors';
import express from 'express';
import { buildSubgraphSchema } from '@apollo/subgraph';
import gql from 'graphql-tag';
import graphqlUploadExpress from "graphql-upload/graphqlUploadExpress.mjs";
import GraphQLUpload from "graphql-upload/GraphQLUpload.mjs";
import bodyParser from 'body-parser';

const typeDefs = gql`
  extend schema
    @link(
      url: "https://specs.apollo.dev/federation/v2.0"
      import: ["@key", "@shareable"]
    )

  type Query {
    me: User
  }

  type User @key(fields: "id") {
    id: ID!
    username: String
  }

  scalar Upload

  type File {
    filename: String!
    mimetype: String!
    encoding: String!
    body: String!
  }

  type Mutation {
    singleUpload(file: Upload): File
  }
`;

const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    me() {
      return { id: '1', username: '@ava' };
    },
  },
  User: {
    __resolveReference(user, { fetchUserById }) {
      return fetchUserById(user.id);
    },
  },
  Mutation: {
    singleUpload: async (parent, { file }) => {
      const result = await file;
      console.log("result", result);
      const { createReadStream, filename, mimetype, encoding } = result;

      const body = await streamToString(createReadStream());
      console.log(body);
      return { filename, mimetype, encoding, body };
      // if (args.file == null) {
      //   return null;
      // }
      // const { file } = args.file;
      // console.log(body);
      // return {
      //   ...(file),
      //   body,
      // }
    },
  },
};

async function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
    });
}

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers }),
});

// Note you must call `start()` on the `ApolloServer`
// instance before passing the instance to `expressMiddleware`
await server.start();

// Required logic for integrating with Express
const app = express();
// Our httpServer handles incoming requests to our Express app.
// Below, we tell Apollo Server to "drain" this httpServer,
// enabling our servers to shut down gracefully.
const httpServer = http.createServer(app);

// Set up our Express middleware to handle CORS, body parsing,
// and our expressMiddleware function.
app.use(
  '/',
  cors<cors.CorsRequest>(),
  bodyParser.json({ limit: "50mb" }),
  graphqlUploadExpress({ maxFileSize: 50000000, maxFiles: 10 }),
  // expressMiddleware accepts the same arguments:
  // an Apollo Server instance and optional configuration options
  expressMiddleware(server, {
    context: async ({ req }) => ({ token: req.headers.token }),
  }),
);

// Modified server startup
await new Promise<void>((resolve) => httpServer.listen({ port: 4001 }, resolve));
console.log(`🚀 Server ready at http://localhost:4001/`);
