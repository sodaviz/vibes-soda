.PHONY: build
build: 
	@echo "Building vibes-soda..."
	rm -rf dist/
	cd src && npx tsc --build tsconfig-src.json
