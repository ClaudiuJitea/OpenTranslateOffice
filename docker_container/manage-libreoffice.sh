#!/usr/bin/env bash
set -euo pipefail
shopt -s extglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/libreoffice-compose.yml"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOST_STORAGE_PATH="${LIBREOFFICE_HOST_STORAGE_PATH:-$PROJECT_DIR/apps/api/storage}"
DEPLOY_ENV_FILE="$SCRIPT_DIR/.libreoffice-deploy.env"
DEFAULT_LANGUAGE_PROFILE="English, Polish, German, French, Spanish, Italian, Portuguese, Dutch, Romanian"

declare -a SELECTED_LANGUAGES=()
declare -a FONT_PACKAGES=()

usage() {
  cat <<USAGE
Usage: ./docker_container/manage-libreoffice.sh <command> [options]

Commands:
  deploy    Build and start the LibreOffice container
            Options:
              --languages "Polish, Japanese, Arabic"
              --no-prompt
  restart   Restart the LibreOffice container
  stop      Stop the LibreOffice container
  delete    Delete the LibreOffice container and local image cache
  status    Show container status and current language/font profile
  logs      Tail container logs
  config    Show the saved language/font profile
USAGE
}

info() {
  printf '[info] %s\n' "$*"
}

warn() {
  printf '[warn] %s\n' "$*" >&2
}

die() {
  printf '[error] %s\n' "$*" >&2
  exit 1
}

trim() {
  local value="$1"
  value="${value##+([[:space:]])}"
  value="${value%%+([[:space:]])}"
  printf '%s' "$value"
}

join_by_comma() {
  local IFS=","
  printf '%s' "$*"
}

ensure_storage_dirs() {
  mkdir -p "$HOST_STORAGE_PATH/intake-uploads" "$HOST_STORAGE_PATH/derived-previews"
}

run_compose() {
  local compose_args=()

  if [[ -f "$DEPLOY_ENV_FILE" ]]; then
    compose_args+=(--env-file "$DEPLOY_ENV_FILE")
  fi

  LIBREOFFICE_HOST_STORAGE_PATH="$HOST_STORAGE_PATH" \
    docker compose "${compose_args[@]}" -f "$COMPOSE_FILE" "$@"
}

normalize_language_key() {
  local value="${1,,}"
  value="${value// /}"
  value="${value//-/}"
  value="${value//_/}"
  value="${value//\//}"
  value="${value//\'/}"
  printf '%s' "$value"
}

register_language() {
  local language="$1"
  local existing

  for existing in "${SELECTED_LANGUAGES[@]:-}"; do
    if [[ "${existing,,}" == "${language,,}" ]]; then
      return
    fi
  done

  SELECTED_LANGUAGES+=("$language")
}

register_package() {
  local package="$1"
  local existing

  if [[ -z "$package" ]]; then
    return
  fi

  for existing in "${FONT_PACKAGES[@]:-}"; do
    if [[ "$existing" == "$package" ]]; then
      return
    fi
  done

  FONT_PACKAGES+=("$package")
}

map_language_to_fonts() {
  local original="$1"
  local key

  key="$(normalize_language_key "$original")"
  register_language "$original"

  case "$key" in
    english|polish|german|french|spanish|italian|portuguese|dutch|romanian|czech|slovak|hungarian|turkish|swedish|danish|norwegian|finnish|estonian|latvian|lithuanian|croatian|serbian|slovenian|bosnian|albanian|irish|welsh|icelandic|maltese|latin|russian|ukrainian|belarusian|bulgarian|macedonian|greek)
      ;;
    chinese|mandarin|cantonese|traditionalchinese|simplifiedchinese|japanese|korean|cjk)
      register_package "fonts-noto-cjk"
      register_package "fonts-noto-cjk-extra"
      ;;
    lao|laotian)
      register_package "fonts-noto-extra"
      register_package "fonts-lao"
      ;;
    khmer|cambodian)
      register_package "fonts-noto-extra"
      register_package "fonts-khmeros-core"
      ;;
    burmese|myanmar)
      register_package "fonts-noto-extra"
      register_package "fonts-sil-padauk"
      ;;
    amharic|ethiopic|tigrinya)
      register_package "fonts-noto-extra"
      register_package "fonts-sil-abyssinica"
      ;;
    arabic|persian|farsi|urdu|hebrew|yiddish|hindi|bengali|tamil|telugu|kannada|malayalam|gujarati|punjabi|gurmukhi|marathi|nepali|sinhala|thai|vietnamese|armenian|georgian|azerbaijani|kazakh|uzbek|mongolian)
      register_package "fonts-noto-extra"
      ;;
    *)
      register_package "fonts-noto-extra"
      warn "Language '$original' is not in the curated font map. Falling back to fonts-noto-extra."
      ;;
  esac
}

prepare_font_profile() {
  local languages_input="$1"
  local raw_languages=()
  local language=""

  SELECTED_LANGUAGES=()
  FONT_PACKAGES=()

  IFS="," read -r -a raw_languages <<< "$languages_input"
  for language in "${raw_languages[@]}"; do
    language="$(trim "$language")"
    if [[ -n "$language" ]]; then
      map_language_to_fonts "$language"
    fi
  done

  if [[ ${#SELECTED_LANGUAGES[@]} -eq 0 ]]; then
    die "At least one language must be provided for deployment."
  fi
}

read_saved_value() {
  local key="$1"

  if [[ ! -f "$DEPLOY_ENV_FILE" ]]; then
    return
  fi

  awk -F= -v target="$key" '$1 == target { print $2 }' "$DEPLOY_ENV_FILE"
}

save_deploy_profile() {
  cat > "$DEPLOY_ENV_FILE" <<EOF
LIBREOFFICE_LANGUAGE_PROFILE=$(join_by_comma "${SELECTED_LANGUAGES[@]}")
LIBREOFFICE_FONT_PACKAGES=$(join_by_comma "${FONT_PACKAGES[@]}")
EOF
}

print_saved_profile() {
  local saved_languages
  local saved_packages

  saved_languages="$(read_saved_value "LIBREOFFICE_LANGUAGE_PROFILE")"
  saved_packages="$(read_saved_value "LIBREOFFICE_FONT_PACKAGES")"

  if [[ -z "$saved_languages" ]]; then
    info "No saved LibreOffice deployment profile found."
    return
  fi

  info "Saved language profile: ${saved_languages//,/, }"
  if [[ -n "$saved_packages" ]]; then
    info "Optional font packages: ${saved_packages//,/, }"
  else
    info "Optional font packages: none"
  fi
}

prompt_for_languages() {
  local default_profile
  local input

  default_profile="$(read_saved_value "LIBREOFFICE_LANGUAGE_PROFILE")"
  if [[ -z "$default_profile" ]]; then
    default_profile="$DEFAULT_LANGUAGE_PROFILE"
  fi

  printf 'Languages to support for translation rendering [%s]: ' "$default_profile"
  read -r input
  input="$(trim "$input")"

  if [[ -z "$input" ]]; then
    input="$default_profile"
  fi

  printf '%s' "$input"
}

handle_deploy() {
  local languages_input=""
  local no_prompt="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --languages)
        [[ $# -ge 2 ]] || die "--languages requires a comma-separated value."
        languages_input="$2"
        shift 2
        ;;
      --no-prompt)
        no_prompt="true"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown deploy option: $1"
        ;;
    esac
  done

  if [[ -z "$languages_input" ]]; then
    if [[ "$no_prompt" == "true" || ! -t 0 ]]; then
      languages_input="$(read_saved_value "LIBREOFFICE_LANGUAGE_PROFILE")"
      if [[ -z "$languages_input" ]]; then
        languages_input="$DEFAULT_LANGUAGE_PROFILE"
        warn "No interactive terminal detected. Using default language profile: $languages_input"
      else
        info "Using saved language profile: ${languages_input//,/, }"
      fi
    else
      languages_input="$(prompt_for_languages)"
    fi
  fi

  prepare_font_profile "$languages_input"
  save_deploy_profile

  info "Deploying LibreOffice container"
  info "Languages: $(join_by_comma "${SELECTED_LANGUAGES[@]}")"
  if [[ ${#FONT_PACKAGES[@]} -gt 0 ]]; then
    info "Additional font packages: $(join_by_comma "${FONT_PACKAGES[@]}")"
  else
    info "Additional font packages: none"
  fi

  ensure_storage_dirs
  run_compose up -d --build
  run_compose ps
}

handle_status() {
  run_compose ps
  print_saved_profile
}

COMMAND="${1:-}"
if [[ -z "$COMMAND" ]]; then
  usage
  exit 1
fi
shift || true

case "$COMMAND" in
  deploy)
    handle_deploy "$@"
    ;;
  restart)
    run_compose restart libreoffice
    run_compose ps
    ;;
  stop)
    run_compose stop libreoffice
    run_compose ps
    ;;
  delete)
    run_compose down --rmi local --remove-orphans
    ;;
  status)
    handle_status
    ;;
  logs)
    run_compose logs -f libreoffice
    ;;
  config)
    print_saved_profile
    ;;
  *)
    usage
    exit 1
    ;;
esac
