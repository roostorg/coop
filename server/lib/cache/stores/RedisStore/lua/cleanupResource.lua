-- Keys for entries that should be expired.
local expired_entry_keys = redis.call('zrangebyscore', KEYS[1], 0, ARGV[1])

-- If there are no expired entries, there's no cleanup we need to do.
-- This can happen, e.g., because of clock skew between multiple node apps
-- running cache frontends, or other unforeseen concurrency issues.
-- if expired_entry_keys[1] == nil then return end;

-- Because of the same clock skew issues, we also want to check that all of the
-- should-be-expired entries are actually gone. if they aren't, just error and
-- rely on the next/retry invocation of this function to do the work for us.
-- if redis.call('exists', unpack(expired_entry_keys)) ~= 0 then
--   return {err="Some expected-to-be-expired entries were still here; try later."}
-- end;

-- Since all the variants are gone, do the cleanup.
-- Start by removing the expired entries from the entryKeys key.
redis.call('zremrangebyscore', KEYS[1], 0, ARGV[1])

-- Now, remove excess items in varyKeysSets key.
-- To do that, start by computing what the new value of that key should be.
local current_entry_keys = redis.call('zrange', KEYS[1], 0, -1)
local new_vary_keys_sets = {} -- format is { [vary_keys_set_str]: true }
for _, v in ipairs(current_entry_keys) do
  local variant_key = string.sub(v, ARGV[2])
  local variant_key_data = cjson.decode(variant_key)
  local vary_keys_set = {}
  for j, variant_key_component in ipairs(variant_key_data) do
    if j % 2 == 1 then -- this is a key name not a value
      table.insert(vary_keys_set, variant_key_component)
    end
  end
  -- Store key for this vary_keys_set in our dictionary of
  -- param set keys to ultimately save
  new_vary_keys_sets[cjson.encode(vary_keys_set)] = true
end

-- Thus far, we've put the vary_keys_set_keys as the keys/field names
-- of res (so lua will de-dupe them for us), but now we need to move
-- those keys into an array that we can unpack into redis.call().
local new_vary_keys_sets_arr = {}
for k, _ in pairs(new_vary_keys_sets) do
  table.insert(new_vary_keys_sets_arr, k)
end

-- Finally, set the varyKeysSets key to the new value.
local vary_keys_sets_key = KEYS[2]

-- Delete old varyKeysSets key before we construct new one.
redis.call('del', vary_keys_sets_key)
if new_vary_keys_sets_arr[1] ~= nil then
  redis.call('sadd', vary_keys_sets_key, unpack(new_vary_keys_sets_arr))
end

return {ok=1}