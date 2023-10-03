bundle:
	@echo "Building vibes-soda bundle..."
	npx esbuild --minify --bundle src/main.js --outfile=vibes-soda.js --global-name=vs

html: bundle
	python3 parse.py output-small
