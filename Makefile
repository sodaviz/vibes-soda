.PHONY: build
build: 
	@echo "Building vibes-soda..."
	rm -rf dist/
	cd src && npx tsc --build tsconfig-src.json

bundle:
	@echo "Building vibes-soda bundle..."
	npx esbuild --bundle src/main.ts --outfile=vibes-soda.js --minify --global-name=vibesSoda
