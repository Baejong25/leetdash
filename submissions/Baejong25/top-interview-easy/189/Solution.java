import java.util.*;

class Solution {
    public void rotate(int[] nums, int k) {
        int[] copy = Arrays.copyOf(nums, nums.length);
        int idx = 0;
        k = k%nums.length;
        
        for (int i = copy.length-k; i < copy.length; i++) {
            nums[idx++] = copy[i];
        }

        for (int i = 0; i < copy.length-k; i++) {
            nums[idx++] = copy[i];
        }
    }
}