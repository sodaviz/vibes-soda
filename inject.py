
vibes_bundle = open("vibes-soda.js").read()
vibes_css = open("src/styles.css").read()
vibes_data = open("data.js").read()
html_template = open("src/template.html").read()

html_blob = html_template.replace("VIBES_DATA_TARGET", vibes_data)
html_blob = html_blob.replace("VIBES_CSS_TARGET", vibes_css)
html_blob = html_blob.replace("VIBES_SODA_TARGET", vibes_bundle)

out = open("vibes-blob.html", "w")

out.write(html_blob)
out.close()
