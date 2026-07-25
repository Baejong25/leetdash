class Solution {

    private int[] init;

    public Solution(int[] nums) {
        init = Arrays.copyOf(nums, nums.length);
    }

    public int[] reset() {
        return init;
    }

    public int[] shuffle() {
        Random random = new Random();

        int[] nums = Arrays.copyOf(init, init.length);

        for(int i = 0; i < nums.length; i++){

            int idx = i + random.nextInt(nums.length - i);

            int tmp = nums[idx];
            nums[idx] = nums[i];
            nums[i] = tmp;

        }

        return nums;
    }
}

/**
 * Your Solution object will be instantiated and called as such:
 * Solution obj = new Solution(nums);
 * int[] param_1 = obj.reset();
 * int[] param_2 = obj.shuffle();
 */