import java.util.*;

class Solution {
    public int[] intersect(int[] nums1, int[] nums2) {
        int idx = 0;
        if (nums1.length > nums2.length) {
            int[] arr1 = new int[nums2.length];
            for (int a : nums2) {
                for (int i = 0; i < nums1.length; i++) {
                    if (a == nums1[i]) {
                        arr1[idx++] = a;
                        nums1[i] = -1;
                        break;
                    }
                }
            }
            return Arrays.copyOf(arr1, idx);
        } else {
            int[] arr1 = new int[nums1.length];
            for (int a : nums1) {
                for (int i = 0 ; i < nums2.length; i++) {
                    if (a == nums2[i]) {
                        arr1[idx++] = a;
                        nums2[i] = -1;
                        break;
                    }
                }
            }
            return Arrays.copyOf(arr1, idx);
        }
    }
}