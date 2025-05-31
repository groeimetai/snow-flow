package client

//go:generate bun run ../../../opencode/src/index.ts generate
//go:generate go tool github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen --package=client --generate=types,client,models -o generated-client.go ./gen/openapi.json
