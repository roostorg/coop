-- Build list of keys for the id's entries, using the values in the entryKeys
-- key, plus the passed in key for the empty-vary variant.
local entry_keys = redis.call('zrange', KEYS[1], 0, -1)
table.insert(entry_keys, KEYS[3])

-- Delete the resource's variants. len(entry_keys) is always > 0 because of the
-- default, empty-vary variant key, so this is safe.
redis.call('unlink', unpack(entry_keys))

-- Delete the entryKeys key itself and the varyKeysSets key, as passed in.
redis.call('unlink', KEYS[1], KEYS[2])

return {ok=1}