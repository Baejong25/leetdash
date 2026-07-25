class Solution {
    public int maxSubArray(int[] nums) {
        //앞의 subarray의 합이 음수인데 양수가 나온경우 그냥 앞에놈 버리고 거기서부터 시작.

        int sum = nums[0];
        int max = nums[0];
        for(int i = 1; i < nums.length; i++){

            sum = Math.max(nums[i], sum + nums[i]);
            max = Math.max(max, sum);
        }

        return max;
    }
}