import java.util.ArrayList; 
class Solution {
    public int[] solution(int n, int[] numlist) {
        ArrayList<Integer> arr_list = new ArrayList<>(); 
        
        for (int i = 0; i < numlist.length; i++){
            if (numlist[i] % n == 0){
                arr_list.add(numlist[i]); 
            }
        }
        
        int[] result = new int[arr_list.size()]; 
        for (int i = 0; i < arr_list.size(); i++){
            result[i] = arr_list.get(i); 
        }
        
        return result; 
    }
}