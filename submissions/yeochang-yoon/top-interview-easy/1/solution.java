class Solution {
    public int[] twoSum(int[] nums, int target) {
        //그냥 다 돌아서 찾는건 쉬움. 근데 한번에 찾는게 가능하려나?

        int n = nums.length;

        HashMap<Integer, Integer> map = new HashMap<>();

        for(int i = 0; i < n; i++){
            if(map.containsKey(nums[i])){
                return new int[] {map.get(nums[i]), i};
            } else {
                map.put(target-nums[i], i);
            }
        }

        return null;
    }
}