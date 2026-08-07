import java.util.*;
class Solution {
    public boolean containsDuplicate(int[] nums) {
        Set<Integer> sense = new HashSet<>();

        for (int a : nums) {
            if(!sense.add(a)) {
                return true;
            }
        }
        return false;
    }
}