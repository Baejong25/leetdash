import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

class Solution {
	public boolean containsDuplicate(int[] nums) {
		Integer[] array = Arrays.stream(nums).boxed().toArray(Integer[]::new);
		
    	Set<Integer> set = new HashSet<Integer>(Arrays.asList(array));
    	
    	if(nums.length != set.size()) {
    		return true;
    	}else return false;
    }
    
}