all: \
	dist/out.sql \


clean: \

	@rm -rf dist


smoke: \
	dist/out.sql \
	../../cli \

	@createdb sqlpatch-test-quote
	@psql -d sqlpatch-test-quote < $<
	@dropdb sqlpatch-test-quote


dist/out.sql: \
	src/*.sql \

	@mkdir -p $(@D)

	node ../../cli $^ > $@


.PHONY: \
	all \
	clean \
	smoke \


