import java.util.ArrayList; 
class Solution {
    public int[] solution(int n) {
        ArrayList <Integer> arr = new ArrayList<>(); 
        for (int i = 0; i < n+1; i++){
            if (i % 2 == 1){
                arr.add(i); 
            }
        }
        
        int[] result = new int[arr.size()]; 
        for (int i = 0; i < arr.size(); i++){
            result[i] = arr.get(i); 
        }
        
        return result; 
    }
}