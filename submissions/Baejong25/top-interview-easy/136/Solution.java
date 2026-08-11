import java.util.*;

class Solution {
    public int singleNumber(int[] nums) {
        int[] arr = Arrays.copyOf(nums, nums.length);
        Arrays.sort(arr);
        for (int i = 0 ;i < arr.length; i++) {
            if (arr.length == 1) {
                return arr[i];
            }
            else if (i == 0 && arr[i] != arr[i+1]) {
                return arr[i];
            }
            else if (i == arr.length-1 && arr[i] != arr[i-1]) {
                return arr[i];
            }
            else if (arr[i+1] != arr[i] && arr[i-1] != arr[i]) {
                return arr[i];
            }
        }
        return -1;
    }
}