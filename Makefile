#!make
BUILD        = ./.build/docker-build
BUILD_URL    = "https://raw.githubusercontent.com/autermann/docker-build/master/docker-build"
BUILD_FLAGS += --url "https://www.conterra.de/mapapps"
BUILD_FLAGS += --license "Apache-2.0"
BUILD_FLAGS += --vendor "52°North GmbH"

all: docker

$(BUILD):
	@mkdir -p .build
	@curl -sLf $(BUILD_URL) -o $(BUILD)
	@chmod +x $(BUILD)

.PHONY: clean
clean:
	@rm -rf .build

.PHONY: docker
docker: $(BUILD)
	$(BUILD) $(BUILD_FLAGS) --push --pull -r edp/ckan-proxy -L master .
