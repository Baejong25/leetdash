class Solution {
    public void moveZeroes(int[] nums) {
        int count = 0;

        if(nums.length == 1){
            return;
        }

        for(int i = 0; i < nums.length-1-count; i++){
            while(nums[i] == 0 && i < nums.length-1-count){
                for(int j = i; j < nums.length - 1 - count; j++){
                    nums[j] = nums[j+1];
                }
                nums[nums.length-1-count] = 0;
                count++;
            }
        }
    }
}