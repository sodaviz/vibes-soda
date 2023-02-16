.PHONY: build
build:
	mkdir -p build/
	cp src/styles.css build/
	npx tsc --build tsconfig.json
	npx esbuild js/main.js --sourcemap --bundle --outfile=build/main.js
	npx pug-cli -P src/index.pug -o build/

.PHONY: serve
serve: build
	@echo "SERVE invoked at $$(date)"
	@echo "Running server on localhost:8080"
	@echo "Use ctrl-c to stop"
	@python3 -m http.server -d build/ -b localhost 8080 && echo "Bye bye!"
