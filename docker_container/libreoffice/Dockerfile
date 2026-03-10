FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ARG LIBREOFFICE_FONT_PACKAGES=""

RUN set -eux; \
  extra_font_packages="$(printf '%s' "$LIBREOFFICE_FONT_PACKAGES" | tr ',' ' ')"; \
  apt-get update; \
  apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-core \
    libreoffice-common \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-pol \
    tesseract-ocr-deu \
    tesseract-ocr-fra \
    tesseract-ocr-spa \
    tesseract-ocr-ita \
    tesseract-ocr-por \
    tesseract-ocr-nld \
    python3-reportlab \
    fonts-dejavu \
    fonts-liberation \
    fonts-noto-core \
    ca-certificates \
    $extra_font_packages; \
  fc-cache -f; \
  rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Keep the container running; conversion is executed via `docker exec`.
CMD ["tail", "-f", "/dev/null"]
