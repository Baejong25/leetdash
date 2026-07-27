import java.util.*;
import java.util.Map.*;

class Solution {
    public int majorityElement(int[] nums) {
        //      Value    Count
        HashMap<Integer, Integer> m = new HashMap<>();

        for (int i = 0; i < nums.length; i++) {
            m.put(nums[i], m.getOrDefault(nums[i], 0) + 1);
        }


        int max=  0;
        int v = 0;

        for (Entry<Integer, Integer> e: m.entrySet()) {
            System.out.println(e.getKey() + " " + e.getValue());
            if (e.getValue() > max) {
                max = e.getValue();
                v = e.getKey();
            }
        }

        return v;
    }
}
