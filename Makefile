bundle:
	@echo "Building vibes-soda bundle..."
	# npx esbuild --bundle src/main.ts --outfile=vibes-soda.js --minify --global-name=vs
	npx esbuild --bundle src/main.ts --outfile=vibes-soda.js --global-name=vs

blob: bundle
	python3 inject.py
