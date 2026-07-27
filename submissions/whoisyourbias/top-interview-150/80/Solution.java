class Solution {
    public int removeDuplicates(int[] nums) {

        int cur_value_count = 1;
        int jump_c = 0;
        for (int i = 1 ; i < nums.length; i++) {
            if (nums[i] == nums[i - 1]) {
                cur_value_count++;
                if (cur_value_count > 2) {
                    jump_c++;
                    continue;
                }
            } else {
                cur_value_count = 1;
            }

            nums[i - jump_c] = nums[i];
        }        
        return nums.length - jump_c;
    }
}
