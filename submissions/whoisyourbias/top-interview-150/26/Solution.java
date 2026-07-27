
/*
0 <= nums.length <= 100
0 <= nums[i] <= 50
0 <= val <= 100
 *
 * */
class Solution {
    public int removeElement(int[] nums, int val) {
        int jumped = 0;

        for (int i = 0; i < nums.length; i++) {
            if (nums[i] == val) {
                jumped++;
                continue;
            } else {
                nums[i - jumped] = nums[i];
            }
        }

        return nums.length  -jumped;
    }
}
