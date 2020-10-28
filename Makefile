COMMIT_HASH=$(shell git rev-parse --short HEAD)

api:
ifndef version
	err = $(error version is undefined)
	$(err)
endif
ifndef path
	err = $(error path is undefined)
	$(err)
endif
	rm -rf ./src/api
	mkdir -p ./src/api
	cp $(path) ./src/api/
	docker run --rm -v ${PWD}:/local openapitools/openapi-generator-cli:v4.3.1 \
	    generate -p packageName=onepanel.core.api,projectName=onepanel.core.api,packageVersion=$(version) \
		-i /local/src/api/api.swagger.json \
		-g typescript-angular \
		-o /local/src/api
	rm ./src/api/api.swagger.json ./src/api/.gitignore ./src/api/.openapi-generator-ignore
	rm -rf ./src/api/.openapi-generator

dist-prod:
	ng build --prod

docker-build:
	docker build -t onepanel-core-ui .
	docker tag onepanel-core-ui:latest onepanel/core-ui:$(COMMIT_HASH)

docker-push:
	docker push onepanel/core-ui:$(COMMIT_HASH)

docker-custom:
	docker build -t onepanel-core-ui . --build-arg VERSION=$(VERSION)
	docker tag onepanel-core-ui:latest onepanel/core-ui:$(TAG)
	docker push onepanel/core-ui:$(TAG)

docker: dist-prod docker-build docker-push

