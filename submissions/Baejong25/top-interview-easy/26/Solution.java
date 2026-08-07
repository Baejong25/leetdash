class Solution {
    public int removeDuplicates(int[] nums) {
        if (nums.length == 0) return 0;

        int now = -101;
        int idx = 0;

        for (int i = 0; i < nums.length; i++) {
            if (now == nums[i]) {
                continue;
            } else if (now != nums[i]) {
                now = nums[i];
                nums[idx++] = nums[i];
            }
        }

        return idx;
    }
}